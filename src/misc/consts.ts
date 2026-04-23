export const development = 'development' as const;
export const production = 'production' as const;

export type Environment = typeof development | typeof production;
