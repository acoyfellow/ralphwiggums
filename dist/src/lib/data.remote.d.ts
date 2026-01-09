interface ExtractionRequest {
    url: string;
    instructions?: string;
}
interface ExtractionResponse {
    success: boolean;
    data?: string;
    message?: string;
    error?: string;
    iterations?: number;
}
export declare const extract: import("@sveltejs/kit").RemoteQueryFunction<ExtractionRequest, ExtractionResponse>;
export {};
