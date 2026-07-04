export const metadata = {
  title: "Automation Builder | metawhat",
};

export default function AutomationBuilderLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="h-dvh overflow-hidden bg-[#E7F8EF] text-[#081B3A]">
      {children}
    </main>
  );
}
