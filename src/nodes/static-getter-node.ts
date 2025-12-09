export type StaticGetterNode<DataTypes extends keyof Record<string, any>> = {
  name: string;
  type: DataTypes;
};
