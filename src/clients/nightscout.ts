export async function fetchDataSince(date: Date): Promise<{ date: Date }[]> {
  // Fetches data from Nightscout since the given date
  // This is a placeholder function, replace it with your own implementation
  return [
    { date: new Date('2023-01-01T00:00:00Z') },
    { date: new Date('2023-02-01T00:00:00Z') },
    { date: new Date('2023-03-01T00:00:00Z') },
  ];
}
