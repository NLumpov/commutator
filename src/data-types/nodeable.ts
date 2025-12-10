export const enum NodeableType {
  StaticGetter = "StaticGetter",
  RemoteGetter = "RemoteGetter",
  Macros = "Macros",
}

export type Nodeable = {
  readonly uuid: string;
  readonly nodeType: NodeableType;
  x: number;
  y: number;
};
