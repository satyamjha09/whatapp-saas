import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { syncUser } from "@/server/services/auth.service";
import { createCompanyForUser } from "@/server/services/company.service";
import { createCompanySchema } from "@/server/validators/company.validator";

export async function POST(request: Request) {
  try {
    const clerkUser = await currentUser();

    if (!clerkUser) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const primaryEmail =
      clerkUser.emailAddresses.find(
        (email) => email.id === clerkUser.primaryEmailAddressId,
      )?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;

    if (!primaryEmail) {
      return NextResponse.json(
        { message: "No email found for user" },
        { status: 400 },
      );
    }

    const body: unknown = await request.json();

    const validation = createCompanySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid company details",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const user = await syncUser({
      clerkUserId: clerkUser.id,
      email: primaryEmail,
      name: clerkUser.fullName,
      imageUrl: clerkUser.imageUrl,
    });

    const company = await createCompanyForUser(user.id, validation.data.name);

    return NextResponse.json(
      {
        message: "Company created successfully",
        company,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("CREATE_COMPANY_ERROR:", error);

    if (
      error instanceof Error &&
      error.message === "User already belongs to a company"
    ) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }

    return NextResponse.json(
      { message: "Something went wrong while creating company" },
      { status: 500 },
    );
  }
}
