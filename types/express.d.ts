// file: types/express.d.ts
declare module 'express' {
  import { IncomingMessage, ServerResponse } from 'http';
  import { RequestListener } from 'http';
  
  export interface Request extends IncomingMessage {
    body?: any;
    params?: any;
    query?: any;
  }
  
  export interface Response extends ServerResponse {
    status(code: number): this;
    json(body: any): this;
    send(body: any): this;
  }
  
  export interface Application extends RequestListener {
    use: (handler: any) => void;
    get: (path: string, handler: (req: Request, res: Response) => void) => void;
    post: (path: string, handler: (req: Request, res: Response) => void) => void;
    listen: (port: number | string, callback?: () => void) => void;
  }

  interface ExpressFunction {
    (): Application;
    json: () => any;
  }
  
  const express: ExpressFunction;
  export default express;
}
