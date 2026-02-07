export interface Product {
    url: string;
    name?: string;
    price?: string;
    lastSeenPrice?: number;
}

export interface Subscription {
    email: string;
    product: Product;
    createdAt?: string;
    lastNotifiedAt?: string;
}

export interface ApiResponse {
    ok: boolean;
    error?: string;
    [key: string]: any;
}

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