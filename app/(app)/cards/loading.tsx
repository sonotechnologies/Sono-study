import { PageSkeleton } from "@/components/account/skeletons";

export default function Loading() {
  return <PageSkeleton label="Loading cards" hero={false} rows={5} narrow={true} />;
}
