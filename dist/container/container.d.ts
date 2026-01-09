/**
 * RalphWiggums Container for Cloudflare Containers
 * Routes requests to the container server implementation.
 */
import { Container } from "@cloudflare/containers";
export declare class RalphContainer extends Container {
    defaultPort: number;
    envVars: {
        AI_PROVIDER: string;
        CLOUDFLARE_ACCOUNT_ID: string;
        CLOUDFLARE_API_TOKEN: string;
        CLOUDFLARE_MODEL: string;
        ZEN_API_KEY: string;
        ZEN_MODEL: string;
    };
    onRequest(request: Request): Promise<Response>;
}
