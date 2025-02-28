declare module '@streamflow/stream' {
  export class StreamflowSolana {
    constructor(config: { connection: any; cluster: string });
    create(params: any): Promise<any>;
  }
} 