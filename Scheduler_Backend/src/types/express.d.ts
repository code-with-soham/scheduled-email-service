declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
      user?: { googleSubject: string; email: string; name?: string; picture?: string };
    }
  }
}

export {};
