import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  getOrCreateWallet,
  getWalletTransactions,
  topUpWallet,
} from "@/server/services/wallet.service";
import { topUpWalletSchema } from "@/server/validators/wallet.validator";

export async function GET() {
  try {
    const context = await getCurrentWorkspaceContext();

    if (!context) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!context.membership) {
      return NextResponse.json(
        { message: "Complete company onboarding first" },
        { status: 403 },
      );
    }

    const companyId = context.membership.companyId;

    const [wallet, transactions] = await Promise.all([
      getOrCreateWallet(companyId),
      getWalletTransactions(companyId),
    ]);

    return NextResponse.json({
      wallet,
      transactions,
    });
  } catch (error) {
    console.error("GET_WALLET_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to fetch wallet" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const context = await getCurrentWorkspaceContext();

    if (!context) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!context.membership) {
      return NextResponse.json(
        { message: "Complete company onboarding first" },
        { status: 403 },
      );
    }

    if (
      context.membership.role !== "OWNER" &&
      context.membership.role !== "ADMIN"
    ) {
      return NextResponse.json(
        { message: "You do not have permission to top up wallet" },
        { status: 403 },
      );
    }

    const body: unknown = await request.json();

    const validation = topUpWalletSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid wallet top-up details",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const result = await topUpWallet(
      context.membership.companyId,
      validation.data,
    );

    return NextResponse.json({
      message: "Wallet topped up successfully",
      ...result,
    });
  } catch (error) {
    console.error("TOP_UP_WALLET_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to top up wallet" },
      { status: 500 },
    );
  }
}
