export type NonNeverKeyof<T> = {
  [K in keyof T]: T[K] extends never ? never : K;
}[keyof T];
