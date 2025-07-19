
'use server';

import { collection, getDocs, doc, getDoc, query, where, Timestamp, orderBy, OrderByDirection, limit as firestoreLimit } from 'firebase/firestore';
import { db } from '@/firebase';
import type { Product } from '@/types';

// Helper function to safely serialize Firestore Timestamps
const serializeProduct = (doc: any): Product => {
    const data = doc.data();
    const product: Product = { id: doc.id, ...data };
    
    if (data.createdAt && data.createdAt instanceof Timestamp) {
        product.createdAt = data.createdAt.toDate().toISOString();
    }
    
    return product;
}

interface GetProductsOptions {
    category?: string;
    sellerId?: string;
    limit?: number;
}

export async function getProducts(options: GetProductsOptions = {}): Promise<Product[]> {
    let q = query(collection(db, 'products'));

    if (options.category && options.category !== 'All') {
        q = query(q, where('category', '==', options.category));
    }
    
    if (options.sellerId) {
        q = query(q, where('sellerId', '==', options.sellerId));
    }
    
    if (options.limit) {
        q = query(q, firestoreLimit(options.limit));
    }

    const productSnapshot = await getDocs(q);

    const productList = productSnapshot.docs.map(serializeProduct);
    
    // Final availability filter
    return productList.filter(product => product.isAvailable !== false);
}

export async function getProductById(id: string): Promise<Product | null> {
  const productRef = doc(db, 'products', id);
  const productSnap = await getDoc(productRef);

  if (productSnap.exists()) {
    return serializeProduct(productSnap);
  } else {
    return null;
  }
}
