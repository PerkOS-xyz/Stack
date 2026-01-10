import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  DocumentData,
  QueryConstraint,
  WhereFilterOp,
  OrderByDirection,
  DocumentReference,
  CollectionReference,
  Query,
  Firestore
} from 'firebase/firestore';
import { cert, initializeApp as initializeAdminApp, getApps as getAdminApps, App as AdminApp } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore, Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { getStorage as getAdminStorage, Storage as AdminStorage } from 'firebase-admin/storage';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject, FirebaseStorage } from 'firebase/storage';

// Firebase client configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize client-side Firebase app
let app: FirebaseApp;
let db: Firestore;

function getClientApp(): FirebaseApp {
  if (!app) {
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  }
  return app;
}

function getClientFirestore(): Firestore {
  if (!db) {
    db = getFirestore(getClientApp());
  }
  return db;
}

// Initialize server-side Firebase Admin app
let adminApp: AdminApp;
let adminDb: AdminFirestore;

function getAdminApp(): AdminApp {
  if (!adminApp) {
    if (getAdminApps().length) {
      adminApp = getAdminApps()[0];
    } else {
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (serviceAccount) {
        try {
          const parsedAccount = JSON.parse(serviceAccount);
          adminApp = initializeAdminApp({
            credential: cert(parsedAccount)
          });
          console.log('[Firebase Admin] Initialized with service account for project:', parsedAccount.project_id);
        } catch (parseError) {
          console.error('[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT:', parseError);
          console.error('[Firebase Admin] Service account value (first 100 chars):', serviceAccount.substring(0, 100));
          throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT format. Ensure it is a valid JSON string.');
        }
      } else {
        console.warn('[Firebase Admin] No FIREBASE_SERVICE_ACCOUNT found, using application default credentials');
        // Fallback for development - use application default credentials
        adminApp = initializeAdminApp();
      }
    }
  }
  return adminApp;
}

function getAdminFirestoreDb(): AdminFirestore {
  if (!adminDb) {
    adminDb = getAdminFirestore(getAdminApp());
  }
  return adminDb;
}

// Type definitions for query builder
interface QueryFilter {
  field: string;
  op: WhereFilterOp;
  value: unknown;
}

interface QueryOrder {
  field: string;
  direction: OrderByDirection;
}

interface QueryResult<T> {
  data: T[] | null;
  error: Error | null;
  count?: number | null;
}

interface SingleResult<T> {
  data: T | null;
  error: Error | null;
}

interface MutationResult<T> {
  data: T | null;
  error: Error | null;
}

interface SelectOptions {
  count?: 'exact' | 'planned' | 'estimated';
  head?: boolean; // When true, return count only without data
}

/**
 * Supabase-compatible query builder for Firestore
 * Provides a familiar API for migration from Supabase
 * Implements PromiseLike so it can be awaited directly
 */
class FirestoreQueryBuilder<T extends DocumentData = DocumentData> implements PromiseLike<QueryResult<T>> {
  private collectionName: string;
  private filters: QueryFilter[] = [];
  private orderByField: QueryOrder | null = null;
  private limitCount: number | null = null;
  private offsetCount: number | null = null;
  private selectFields: string[] | null = null;
  private useAdmin: boolean;
  private withCount: boolean = false;
  private headOnly: boolean = false;

  constructor(collectionName: string, useAdmin: boolean = false) {
    this.collectionName = collectionName;
    this.useAdmin = useAdmin;
  }

  select(fields: string = '*', options?: SelectOptions): this {
    if (fields !== '*') {
      this.selectFields = fields.split(',').map(f => f.trim());
    }
    if (options?.count) {
      this.withCount = true;
    }
    if (options?.head) {
      this.headOnly = true;
      this.withCount = true;
    }
    return this;
  }

  eq(field: string, value: unknown): this {
    this.filters.push({ field, op: '==', value });
    return this;
  }

  neq(field: string, value: unknown): this {
    this.filters.push({ field, op: '!=', value });
    return this;
  }

  gt(field: string, value: unknown): this {
    this.filters.push({ field, op: '>', value });
    return this;
  }

  gte(field: string, value: unknown): this {
    this.filters.push({ field, op: '>=', value });
    return this;
  }

  lt(field: string, value: unknown): this {
    this.filters.push({ field, op: '<', value });
    return this;
  }

  lte(field: string, value: unknown): this {
    this.filters.push({ field, op: '<=', value });
    return this;
  }

  in(field: string, values: unknown[]): this {
    this.filters.push({ field, op: 'in', value: values });
    return this;
  }

  /**
   * OR filter for complex conditions
   * Supabase format: "field1.op.value,field2.op.value"
   * Example: "transaction_hash.ilike.%test%,payer_address.ilike.%test%"
   * Since Firestore doesn't support OR across different fields natively,
   * we store these for client-side filtering
   */
  or(filterString: string): this {
    // Parse the Supabase filter string format
    const conditions = filterString.split(',');
    const orFilters: Array<{ field: string; op: string; value: string }> = [];

    for (const condition of conditions) {
      // Format: field.op.value (e.g., "transaction_hash.ilike.%test%")
      const parts = condition.trim().split('.');
      if (parts.length >= 3) {
        const field = parts[0];
        const op = parts[1];
        const value = parts.slice(2).join('.'); // Handle values that contain dots
        orFilters.push({ field, op, value });
      }
    }

    // Store OR filters for client-side processing
    (this as unknown as { _orFilters: Array<{ field: string; op: string; value: string }[]> })._orFilters =
      (this as unknown as { _orFilters: Array<{ field: string; op: string; value: string }[]> })._orFilters || [];
    (this as unknown as { _orFilters: Array<{ field: string; op: string; value: string }[]> })._orFilters.push(orFilters);

    return this;
  }

  // Case-insensitive LIKE search (Firestore doesn't support this natively,
  // so we use range queries for prefix matching)
  ilike(field: string, pattern: string): this {
    // Convert SQL LIKE pattern to Firestore-compatible query
    // %pattern% is not directly supported, but we can handle prefix matching
    const cleanPattern = pattern.replace(/%/g, '').toLowerCase();
    // For simple patterns, use range queries
    if (pattern.startsWith('%') && pattern.endsWith('%')) {
      // Contains - not directly supported, fetch all and filter client-side
      // Store for post-processing
      this.filters.push({ field, op: '>=', value: '' }); // Fetch all, filter later
      // Mark for client-side filtering
      (this as unknown as { _ilikeFilters: Array<{field: string; pattern: string}> })._ilikeFilters =
        (this as unknown as { _ilikeFilters: Array<{field: string; pattern: string}> })._ilikeFilters || [];
      (this as unknown as { _ilikeFilters: Array<{field: string; pattern: string}> })._ilikeFilters.push({ field, pattern: cleanPattern });
    } else if (!pattern.startsWith('%')) {
      // Prefix match
      const endStr = cleanPattern.slice(0, -1) + String.fromCharCode(cleanPattern.charCodeAt(cleanPattern.length - 1) + 1);
      this.filters.push({ field, op: '>=', value: cleanPattern });
      this.filters.push({ field, op: '<', value: endStr });
    }
    return this;
  }

  order(field: string, options: { ascending?: boolean } = {}): this {
    this.orderByField = {
      field,
      direction: options.ascending === false ? 'desc' : 'asc'
    };
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  // Pagination: range(from, to) - returns rows from index 'from' to 'to' (inclusive)
  range(from: number, to: number): this {
    this.offsetCount = from;
    this.limitCount = to - from + 1;
    return this;
  }

  private filterDocument(doc: DocumentData): T {
    if (!this.selectFields) {
      return { id: doc.id, ...doc } as unknown as T;
    }
    const filtered: DocumentData = { id: doc.id };
    for (const field of this.selectFields) {
      if (field in doc) {
        filtered[field] = doc[field];
      }
    }
    return filtered as unknown as T;
  }

  /**
   * Helper method to match OR conditions
   * Supports: eq, neq, gt, gte, lt, lte, ilike
   */
  private matchesOrCondition(fieldValue: unknown, op: string, value: string): boolean {
    if (fieldValue === null || fieldValue === undefined) {
      return false;
    }

    switch (op) {
      case 'eq':
        return String(fieldValue) === value;
      case 'neq':
        return String(fieldValue) !== value;
      case 'gt':
        return Number(fieldValue) > Number(value);
      case 'gte':
        return Number(fieldValue) >= Number(value);
      case 'lt':
        return Number(fieldValue) < Number(value);
      case 'lte':
        return Number(fieldValue) <= Number(value);
      case 'ilike': {
        // Case-insensitive LIKE search
        if (typeof fieldValue !== 'string') return false;
        const cleanPattern = value.replace(/%/g, '').toLowerCase();
        return fieldValue.toLowerCase().includes(cleanPattern);
      }
      case 'like': {
        // Case-sensitive LIKE search
        if (typeof fieldValue !== 'string') return false;
        const cleanPattern = value.replace(/%/g, '');
        return fieldValue.includes(cleanPattern);
      }
      default:
        return false;
    }
  }

  // PromiseLike implementation - allows direct await
  then<TResult1 = QueryResult<T>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  async execute(): Promise<QueryResult<T>> {
    try {
      if (this.useAdmin) {
        return await this.executeAdmin();
      }
      return await this.executeClient();
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  private async executeClient(): Promise<QueryResult<T>> {
    const firestore = getClientFirestore();
    const collectionRef = collection(firestore, this.collectionName);

    const constraints: QueryConstraint[] = [];

    for (const filter of this.filters) {
      constraints.push(where(filter.field, filter.op, filter.value));
    }

    if (this.orderByField) {
      constraints.push(orderBy(this.orderByField.field, this.orderByField.direction));
    }

    // For pagination with offset, we need to fetch more and slice
    // Firestore doesn't have native offset, so we fetch extra and slice
    if (this.offsetCount && this.offsetCount > 0) {
      // Fetch offset + limit records
      const fetchLimit = (this.limitCount || 100) + this.offsetCount;
      constraints.push(limit(fetchLimit));
    } else if (this.limitCount) {
      constraints.push(limit(this.limitCount));
    }

    const q = constraints.length > 0
      ? query(collectionRef, ...constraints)
      : collectionRef;

    const snapshot = await getDocs(q);
    let data = snapshot.docs.map(doc => this.filterDocument({ id: doc.id, ...doc.data() }));

    // Apply client-side ilike filtering if needed
    const ilikeFilters = (this as unknown as { _ilikeFilters?: Array<{field: string; pattern: string}> })._ilikeFilters;
    if (ilikeFilters && ilikeFilters.length > 0) {
      data = data.filter(item => {
        return ilikeFilters.every(({ field, pattern }) => {
          const value = (item as Record<string, unknown>)[field];
          if (typeof value === 'string') {
            return value.toLowerCase().includes(pattern);
          }
          return false;
        });
      });
    }

    // Apply client-side OR filtering if needed
    const orFilters = (this as unknown as { _orFilters?: Array<{ field: string; op: string; value: string }[]> })._orFilters;
    if (orFilters && orFilters.length > 0) {
      data = data.filter(item => {
        // Each orFilters entry is a set of conditions where AT LEAST ONE must match
        return orFilters.every(orGroup => {
          return orGroup.some(({ field, op, value }) => {
            const fieldValue = (item as Record<string, unknown>)[field];
            return this.matchesOrCondition(fieldValue, op, value);
          });
        });
      });
    }

    // Apply offset slicing
    if (this.offsetCount && this.offsetCount > 0) {
      data = data.slice(this.offsetCount);
      if (this.limitCount) {
        data = data.slice(0, this.limitCount);
      }
    }

    // Get count if requested
    let count: number | null = null;
    if (this.withCount) {
      // For accurate count, we need to query without limit
      const countQuery = constraints.filter(c =>
        !(c as unknown as { type: string }).type?.includes('limit')
      );
      const countSnapshot = await getDocs(
        countQuery.length > 0
          ? query(collectionRef, ...countQuery)
          : collectionRef
      );
      count = countSnapshot.size;
    }

    // If headOnly, return null data with count only
    return { data: this.headOnly ? null : data, error: null, count };
  }

  private async executeAdmin(): Promise<QueryResult<T>> {
    const firestore = getAdminFirestoreDb();
    let queryRef: FirebaseFirestore.Query = firestore.collection(this.collectionName);

    for (const filter of this.filters) {
      queryRef = queryRef.where(filter.field, filter.op, filter.value);
    }

    if (this.orderByField) {
      queryRef = queryRef.orderBy(this.orderByField.field, this.orderByField.direction);
    }

    // Store base query for count
    const countQueryRef = queryRef;

    // For pagination with offset
    if (this.offsetCount && this.offsetCount > 0) {
      queryRef = queryRef.offset(this.offsetCount);
    }

    if (this.limitCount) {
      queryRef = queryRef.limit(this.limitCount);
    }

    const snapshot = await queryRef.get();
    let data = snapshot.docs.map(doc => this.filterDocument({ id: doc.id, ...doc.data() }));

    // Apply client-side ilike filtering if needed
    const ilikeFilters = (this as unknown as { _ilikeFilters?: Array<{field: string; pattern: string}> })._ilikeFilters;
    if (ilikeFilters && ilikeFilters.length > 0) {
      data = data.filter(item => {
        return ilikeFilters.every(({ field, pattern }) => {
          const value = (item as Record<string, unknown>)[field];
          if (typeof value === 'string') {
            return value.toLowerCase().includes(pattern);
          }
          return false;
        });
      });
    }

    // Apply client-side OR filtering if needed
    const orFilters = (this as unknown as { _orFilters?: Array<{ field: string; op: string; value: string }[]> })._orFilters;
    if (orFilters && orFilters.length > 0) {
      data = data.filter(item => {
        // Each orFilters entry is a set of conditions where AT LEAST ONE must match
        return orFilters.every(orGroup => {
          return orGroup.some(({ field, op, value }) => {
            const fieldValue = (item as Record<string, unknown>)[field];
            return this.matchesOrCondition(fieldValue, op, value);
          });
        });
      });
    }

    // Get count if requested
    let count: number | null = null;
    if (this.withCount) {
      const countSnapshot = await countQueryRef.count().get();
      count = countSnapshot.data().count;
    }

    // If headOnly, return null data with count only
    return { data: this.headOnly ? null : data, error: null, count };
  }

  async single(): Promise<SingleResult<T>> {
    this.limitCount = 1;
    const result = await this.execute();

    if (result.error) {
      return { data: null, error: result.error };
    }

    if (!result.data || result.data.length === 0) {
      // Return Supabase-compatible error with code property
      const error = new Error('No rows returned') as Error & { code: string };
      error.code = 'PGRST116'; // Supabase error code for "no rows returned"
      return { data: null, error };
    }

    return { data: result.data[0], error: null };
  }

  async maybeSingle(): Promise<SingleResult<T>> {
    this.limitCount = 1;
    const result = await this.execute();

    if (result.error) {
      return { data: null, error: result.error };
    }

    if (!result.data || result.data.length === 0) {
      return { data: null, error: null };
    }

    return { data: result.data[0], error: null };
  }
}

/**
 * Supabase-compatible insert builder for Firestore
 * Implements PromiseLike so it can be awaited directly
 */
class FirestoreInsertBuilder<T extends DocumentData = DocumentData> implements PromiseLike<MutationResult<T[]>> {
  private collectionName: string;
  private insertData: DocumentData | DocumentData[];
  private useAdmin: boolean;
  private shouldReturn: boolean = false;

  constructor(collectionName: string, data: DocumentData | DocumentData[], useAdmin: boolean = false) {
    this.collectionName = collectionName;
    this.insertData = data;
    this.useAdmin = useAdmin;
  }

  select(fields?: string): this {
    this.shouldReturn = true;
    return this;
  }

  // PromiseLike implementation - allows direct await
  then<TResult1 = MutationResult<T[]>, TResult2 = never>(
    onfulfilled?: ((value: MutationResult<T[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  async single(): Promise<SingleResult<T>> {
    const result = await this.execute();
    if (result.error) {
      return { data: null, error: result.error };
    }
    return { data: result.data?.[0] || null, error: null };
  }

  async execute(): Promise<MutationResult<T[]>> {
    try {
      const dataArray = Array.isArray(this.insertData) ? this.insertData : [this.insertData];
      const results: T[] = [];

      if (this.useAdmin) {
        const firestore = getAdminFirestoreDb();
        for (const item of dataArray) {
          const docRef = await firestore.collection(this.collectionName).add({
            ...item,
            created_at: item.created_at || Timestamp.now(),
            updated_at: Timestamp.now(),
          });
          if (this.shouldReturn) {
            const doc = await docRef.get();
            results.push({ id: doc.id, ...doc.data() } as unknown as T);
          }
        }
      } else {
        const firestore = getClientFirestore();
        const collectionRef = collection(firestore, this.collectionName);
        for (const item of dataArray) {
          const docRef = await addDoc(collectionRef, {
            ...item,
            created_at: item.created_at || Timestamp.now(),
            updated_at: Timestamp.now(),
          });
          if (this.shouldReturn) {
            const docSnap = await getDoc(docRef);
            results.push({ id: docSnap.id, ...docSnap.data() } as unknown as T);
          }
        }
      }

      return { data: this.shouldReturn ? results : null, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }
}

/**
 * Supabase-compatible update builder for Firestore
 * Implements PromiseLike so it can be awaited directly
 */
class FirestoreUpdateBuilder<T extends DocumentData = DocumentData> implements PromiseLike<MutationResult<T[]>> {
  private collectionName: string;
  private updateData: DocumentData;
  private filters: QueryFilter[] = [];
  private useAdmin: boolean;
  private shouldReturn: boolean = false;

  constructor(collectionName: string, data: DocumentData, useAdmin: boolean = false) {
    this.collectionName = collectionName;
    this.updateData = data;
    this.useAdmin = useAdmin;
  }

  eq(field: string, value: unknown): this {
    this.filters.push({ field, op: '==', value });
    return this;
  }

  select(fields?: string): this {
    this.shouldReturn = true;
    return this;
  }

  // PromiseLike implementation - allows direct await
  then<TResult1 = MutationResult<T[]>, TResult2 = never>(
    onfulfilled?: ((value: MutationResult<T[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  async single(): Promise<SingleResult<T>> {
    const result = await this.execute();
    if (result.error) {
      return { data: null, error: result.error };
    }
    return { data: result.data?.[0] || null, error: null };
  }

  async execute(): Promise<MutationResult<T[]>> {
    try {
      const results: T[] = [];
      const dataWithTimestamp = {
        ...this.updateData,
        updated_at: Timestamp.now(),
      };

      // If filtering by id, update directly
      const idFilter = this.filters.find(f => f.field === 'id');

      if (this.useAdmin) {
        const firestore = getAdminFirestoreDb();

        if (idFilter) {
          const docRef = firestore.collection(this.collectionName).doc(idFilter.value as string);
          await docRef.update(dataWithTimestamp);
          if (this.shouldReturn) {
            const doc = await docRef.get();
            results.push({ id: doc.id, ...doc.data() } as unknown as T);
          }
        } else {
          // Query and update matching documents
          let queryRef: FirebaseFirestore.Query = firestore.collection(this.collectionName);
          for (const filter of this.filters) {
            queryRef = queryRef.where(filter.field, filter.op, filter.value);
          }
          const snapshot = await queryRef.get();
          for (const docSnap of snapshot.docs) {
            await docSnap.ref.update(dataWithTimestamp);
            if (this.shouldReturn) {
              const updated = await docSnap.ref.get();
              results.push({ id: updated.id, ...updated.data() } as unknown as T);
            }
          }
        }
      } else {
        const firestore = getClientFirestore();

        if (idFilter) {
          const docRef = doc(firestore, this.collectionName, idFilter.value as string);
          await updateDoc(docRef, dataWithTimestamp);
          if (this.shouldReturn) {
            const docSnap = await getDoc(docRef);
            results.push({ id: docSnap.id, ...docSnap.data() } as unknown as T);
          }
        } else {
          const collectionRef = collection(firestore, this.collectionName);
          const constraints: QueryConstraint[] = this.filters.map(f => where(f.field, f.op, f.value));
          const q = query(collectionRef, ...constraints);
          const snapshot = await getDocs(q);
          for (const docSnap of snapshot.docs) {
            const docRef = doc(firestore, this.collectionName, docSnap.id);
            await updateDoc(docRef, dataWithTimestamp);
            if (this.shouldReturn) {
              const updated = await getDoc(docRef);
              results.push({ id: updated.id, ...updated.data() } as unknown as T);
            }
          }
        }
      }

      return { data: this.shouldReturn ? results : null, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }
}

/**
 * Supabase-compatible delete builder for Firestore
 * Implements PromiseLike so it can be awaited directly
 */
class FirestoreDeleteBuilder implements PromiseLike<{ error: Error | null }> {
  private collectionName: string;
  private filters: QueryFilter[] = [];
  private useAdmin: boolean;

  constructor(collectionName: string, useAdmin: boolean = false) {
    this.collectionName = collectionName;
    this.useAdmin = useAdmin;
  }

  eq(field: string, value: unknown): this {
    this.filters.push({ field, op: '==', value });
    return this;
  }

  // PromiseLike implementation - allows direct await
  then<TResult1 = { error: Error | null }, TResult2 = never>(
    onfulfilled?: ((value: { error: Error | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  async execute(): Promise<{ error: Error | null }> {
    try {
      const idFilter = this.filters.find(f => f.field === 'id');

      if (this.useAdmin) {
        const firestore = getAdminFirestoreDb();

        if (idFilter) {
          await firestore.collection(this.collectionName).doc(idFilter.value as string).delete();
        } else {
          let queryRef: FirebaseFirestore.Query = firestore.collection(this.collectionName);
          for (const filter of this.filters) {
            queryRef = queryRef.where(filter.field, filter.op, filter.value);
          }
          const snapshot = await queryRef.get();
          for (const docSnap of snapshot.docs) {
            await docSnap.ref.delete();
          }
        }
      } else {
        const firestore = getClientFirestore();

        if (idFilter) {
          const docRef = doc(firestore, this.collectionName, idFilter.value as string);
          await deleteDoc(docRef);
        } else {
          const collectionRef = collection(firestore, this.collectionName);
          const constraints: QueryConstraint[] = this.filters.map(f => where(f.field, f.op, f.value));
          const q = query(collectionRef, ...constraints);
          const snapshot = await getDocs(q);
          for (const docSnap of snapshot.docs) {
            await deleteDoc(doc(firestore, this.collectionName, docSnap.id));
          }
        }
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }
}

/**
 * Supabase-compatible Storage bucket builder for Firebase Storage
 * Provides upload, getPublicUrl, and remove methods matching Supabase API
 */
class FirebaseStorageBucket {
  private bucketName: string;
  private useAdmin: boolean;

  constructor(bucketName: string, useAdmin: boolean = false) {
    this.bucketName = bucketName;
    this.useAdmin = useAdmin;
  }

  /**
   * Upload a file to Firebase Storage
   * Mimics Supabase's storage.from(bucket).upload(path, file, options)
   */
  async upload(
    filePath: string,
    fileData: Buffer | Blob | ArrayBuffer,
    options?: { contentType?: string; upsert?: boolean }
  ): Promise<{ data: { path: string } | null; error: Error | null }> {
    try {
      // Use bucket name as folder prefix in Firebase Storage
      const fullPath = `${this.bucketName}/${filePath}`;

      if (this.useAdmin) {
        const storage = getAdminStorage(getAdminApp());
        const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
        const bucket = storage.bucket(storageBucket);
        const file = bucket.file(fullPath);

        // Convert to Buffer if needed
        let buffer: Buffer;
        if (fileData instanceof Buffer) {
          buffer = fileData;
        } else if (fileData instanceof ArrayBuffer) {
          buffer = Buffer.from(fileData);
        } else if (fileData instanceof Blob) {
          const arrayBuffer = await fileData.arrayBuffer();
          buffer = Buffer.from(arrayBuffer);
        } else {
          buffer = Buffer.from(fileData as unknown as ArrayBuffer);
        }

        await file.save(buffer, {
          contentType: options?.contentType || 'application/octet-stream',
          metadata: {
            contentType: options?.contentType || 'application/octet-stream',
          },
        });

        // Make file publicly accessible
        await file.makePublic();

        return { data: { path: fullPath }, error: null };
      } else {
        // Client-side Firebase Storage
        const storage = getStorage(getClientApp());
        const storageRef = ref(storage, fullPath);

        let uploadData: Blob | Uint8Array;
        if (fileData instanceof Buffer) {
          uploadData = new Uint8Array(fileData);
        } else if (fileData instanceof ArrayBuffer) {
          uploadData = new Uint8Array(fileData);
        } else if (fileData instanceof Blob) {
          uploadData = fileData;
        } else {
          uploadData = new Uint8Array(fileData as unknown as ArrayBuffer);
        }

        await uploadBytes(storageRef, uploadData, {
          contentType: options?.contentType || 'application/octet-stream',
        });

        return { data: { path: fullPath }, error: null };
      }
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  /**
   * Get the public URL for a file
   * Mimics Supabase's storage.from(bucket).getPublicUrl(path)
   */
  getPublicUrl(filePath: string): { data: { publicUrl: string } } {
    const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    const fullPath = `${this.bucketName}/${filePath}`;

    // Firebase Storage public URL format
    const publicUrl = `https://storage.googleapis.com/${storageBucket}/${encodeURIComponent(fullPath).replace(/%2F/g, '/')}`;

    return { data: { publicUrl } };
  }

  /**
   * Remove files from storage
   * Mimics Supabase's storage.from(bucket).remove([paths])
   */
  async remove(filePaths: string[]): Promise<{ error: Error | null }> {
    try {
      if (this.useAdmin) {
        const storage = getAdminStorage(getAdminApp());
        const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
        const bucket = storage.bucket(storageBucket);

        for (const filePath of filePaths) {
          const fullPath = `${this.bucketName}/${filePath}`;
          const file = bucket.file(fullPath);
          await file.delete().catch((err: Error & { code?: number }) => {
            // Ignore "not found" errors
            if (err.code !== 404) throw err;
          });
        }
      } else {
        const storage = getStorage(getClientApp());

        for (const filePath of filePaths) {
          const fullPath = `${this.bucketName}/${filePath}`;
          const storageRef = ref(storage, fullPath);
          await deleteObject(storageRef).catch((err: Error & { code?: string }) => {
            // Ignore "not found" errors
            if (err.code !== 'storage/object-not-found') throw err;
          });
        }
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }
}

/**
 * Supabase-compatible Storage client for Firebase Storage
 */
class FirebaseStorageClient {
  private useAdmin: boolean;

  constructor(useAdmin: boolean = false) {
    this.useAdmin = useAdmin;
  }

  from(bucketName: string): FirebaseStorageBucket {
    return new FirebaseStorageBucket(bucketName, this.useAdmin);
  }
}

/**
 * Supabase-compatible Firestore client
 * Provides a familiar API for easy migration from Supabase
 */
class FirestoreClient {
  private useAdmin: boolean;
  private _storage: FirebaseStorageClient | null = null;

  constructor(useAdmin: boolean = false) {
    this.useAdmin = useAdmin;
  }

  from<T extends DocumentData = DocumentData>(collectionName: string) {
    const useAdmin = this.useAdmin;
    return {
      select: (fields: string = '*', options?: SelectOptions) => {
        const builder = new FirestoreQueryBuilder<T>(collectionName, useAdmin);
        return builder.select(fields, options);
      },
      insert: (data: DocumentData | DocumentData[]) => {
        return new FirestoreInsertBuilder<T>(collectionName, data, useAdmin);
      },
      update: (data: DocumentData) => {
        return new FirestoreUpdateBuilder<T>(collectionName, data, useAdmin);
      },
      delete: () => {
        return new FirestoreDeleteBuilder(collectionName, useAdmin);
      },
      upsert: (data: DocumentData | DocumentData[], options?: { onConflict?: string }) => {
        // Upsert implementation using set with merge
        const upsertObj = {
          error: null as Error | null,
          select: () => ({
            single: async (): Promise<SingleResult<T>> => {
              try {
                const firestore = useAdmin ? getAdminFirestoreDb() : getClientFirestore();
                const item = Array.isArray(data) ? data[0] : data;
                const id = item.id || (options?.onConflict && item[options.onConflict]);

                if (useAdmin) {
                  const docRef = (firestore as AdminFirestore).collection(collectionName).doc(id);
                  await docRef.set({ ...item, updated_at: Timestamp.now() }, { merge: true });
                  const docResult = await docRef.get();
                  return { data: { id: docResult.id, ...docResult.data() } as unknown as T, error: null };
                } else {
                  const docRef = doc(firestore as Firestore, collectionName, id);
                  await setDoc(docRef, { ...item, updated_at: Timestamp.now() }, { merge: true });
                  const docSnap = await getDoc(docRef);
                  return { data: { id: docSnap.id, ...docSnap.data() } as unknown as T, error: null };
                }
              } catch (error) {
                return { data: null, error: error as Error };
              }
            }
          })
        };
        return upsertObj;
      }
    };
  }

  // Direct Firestore access for advanced operations
  get firestore() {
    return this.useAdmin ? getAdminFirestoreDb() : getClientFirestore();
  }

  // Firebase Storage access (Supabase-compatible API)
  get storage(): FirebaseStorageClient {
    if (!this._storage) {
      this._storage = new FirebaseStorageClient(this.useAdmin);
    }
    return this._storage;
  }
}

// Export client instances (matching Supabase pattern)
export const firebase = new FirestoreClient(false);
export const firebaseAdmin = new FirestoreClient(true);

// Export raw Firestore instances for advanced use cases
export { getClientFirestore, getAdminFirestoreDb };

// Export Firestore utilities for direct use
export {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
};

// Type exports
export type { DocumentData, QueryResult, SingleResult, MutationResult };
