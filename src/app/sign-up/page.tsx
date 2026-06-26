import { SignupForm } from "./signup-form";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{
    email?: string;
    redirect_url?: string;
  }>;
}) {
  const params = await searchParams;

  return (
    <SignupForm
      initialEmail={params.email ?? ""}
      redirectUrl={params.redirect_url ?? ""}
    />
  );
}
