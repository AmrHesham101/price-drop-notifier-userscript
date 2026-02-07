/**
 * Shared TypeScript interfaces used across the server application.
 * These provide a lightweight contract between controllers, services
 * and the database model, improving type-safety and readability.
 */

/**
 * Minimal product representation used in API requests and DB documents.
 */
export interface Product {
    url: string;
    name?: string;
    price?: string;
    lastSeenPrice?: number;
}

/**
 * Subscription record stored in MongoDB and returned by API endpoints.
 */
export interface Subscription {
    email: string;
    product: Product;
    createdAt?: string;
    lastNotifiedAt?: string;
}

/**
 * Standard API response envelope used by most endpoints.
 */
export interface ApiResponse {
    ok: boolean;
    error?: string;
    [key: string]: any;
}

/**
 * Result of scraping/extraction operations.
 */
export interface ExtractResult {
    name: string;
    price: string;
    url: string;
}

export interface ExtractResponse extends ApiResponse {
    product?: ExtractResult;
}

export interface SubscribeResponse extends ApiResponse {
    errors?: any[];
}

export interface TriggerResponse extends ApiResponse {
    result?: { checked: number; notified: number };
}