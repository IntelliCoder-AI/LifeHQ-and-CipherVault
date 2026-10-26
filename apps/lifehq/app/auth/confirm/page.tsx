import { ConfirmEmail } from "@/components/confirm-email";
export default async function Confirm({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <ConfirmEmail
      tokenHash={
        typeof params.token_hash === "string"
          ? params.token_hash.slice(0, 128)
          : ""
      }
      type={typeof params.type === "string" ? params.type : ""}
    />
  );
}
