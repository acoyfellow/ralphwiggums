declare module "alchemy/cloudflare" {
  export function Worker(name: string, config: any): Promise<any>;
  export function DurableObjectNamespace(name: string, config: any): Promise<any>;
  export function KVNamespace(name: string, config: any): Promise<any>;
  export function Assets(config: any): Promise<any>;
  export function Container<T>(name: string, config: any): Promise<any>;
}

declare module "alchemy/state" {
  export class CloudflareStateStore {
    constructor(scope: any, options?: { stateToken?: string });
    list(...args: any[]): any;
    count(...args: any[]): any;
    get(...args: any[]): any;
    getBatch(...args: any[]): any;
    set(...args: any[]): any;
    delete(...args: any[]): any;
    clear(...args: any[]): any;
    all(...args: any[]): any;
  }
}

