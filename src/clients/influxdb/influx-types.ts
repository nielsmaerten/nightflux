export type InfluxField =
  ['float', number] |
  ['int', number] |
  ['string', string] |
  ['boolean', boolean];

export type NightfluxPoint = {
  _id: string;
  measurement: string;
  date: Date;
  tags: { [key: string]: string };
  fields: { [key: string]: InfluxField };
  source: string;
};
