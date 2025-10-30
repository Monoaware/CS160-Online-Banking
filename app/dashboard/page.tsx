import { getDashboardData } from "./data";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  // Fetch data on the server side
  const dashboardData = await getDashboardData();

  return <DashboardClient initialData={dashboardData} />;
}
