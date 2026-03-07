import { rankPortfolio } from "@/lib/tools/rankPortfolio";

export async function GET() {
  const portfolio = await rankPortfolio();
  return Response.json(portfolio);
}
