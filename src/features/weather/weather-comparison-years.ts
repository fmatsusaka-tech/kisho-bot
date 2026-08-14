export const splitComparisonYears = (years: string[]) => ({
  recent: years.filter((year) => Number(year) >= 2020),
  historical: years.filter((year) => Number(year) <= 2019),
});
