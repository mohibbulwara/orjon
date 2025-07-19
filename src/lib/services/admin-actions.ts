
'use server';

import { doc, deleteDoc, writeBatch, collection, query, where, getDocs, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import type { User } from '@/types';

export async function deleteUser(userId: string) {
    try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            return { error: 'User not found.' };
        }

        const userToDelete = userSnap.data() as User;
        if (userToDelete.role === 'admin') {
            return { error: 'Cannot delete an admin account.' };
        }

        const productsRef = collection(db, 'products');
        
        const batch = writeBatch(db);

        batch.delete(userRef);

        if (userToDelete.role === 'seller') {
            const q = query(productsRef, where('sellerId', '==', userId));
            const productsSnapshot = await getDocs(q);
            productsSnapshot.forEach((doc) => {
                batch.delete(doc.ref);
            });
        }
        
        await batch.commit();

        return { success: true };
    } catch (error: any) {
        console.error("Error deleting user:", error);
        return { error: 'Failed to delete user and their data.' };
    }
}

export async function deleteProductByAdmin(productId: string) {
    try {
        const productRef = doc(db, 'products', productId);
        await deleteDoc(productRef);
        return { success: true };
    } catch (error: any) {
        console.error("Error deleting product:", error);
        return { error: 'Failed to delete product.' };
    }
}

export async function activateSeller(sellerId: string) {
    try {
        const userRef = doc(db, 'users', sellerId);
        await updateDoc(userRef, {
            isSuspended: false,
        });
        return { success: true };
    } catch (error: any) {
        console.error("Error activating seller:", error);
        return { error: 'Failed to activate seller.' };
    }
}
