// Glucose Values
// Example insert:
// glucose,source=CGM mg_dL=110.5,mmol_L=6.1 1710000000000000000

// Typescript type
type GlucosePoint = {
  _measurement: 'bg';
  _time: string;
  source: string;
};

export type NightfluxPoint = {
  measurement: string;
  date: Date;
  tags: { [key: string]: string };
  fields: { [key: string]: number };
  type: 'float' | 'int' | 'string' | 'boolean';
};
