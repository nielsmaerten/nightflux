export type NightfluxPoint = {
  measurement: string;
  date: Date;
  tags: { [key: string]: string };
  fields: { [key: string]: number };
  type: 'float' | 'int' | 'string' | 'boolean';
  source: string;
};
