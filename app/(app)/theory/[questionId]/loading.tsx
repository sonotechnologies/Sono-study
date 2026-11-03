import { PageSkeleton } from "@/components/account/skeletons";

export default function Loading() {
  return <PageSkeleton label="Loading question" hero={true} rows={2} narrow={true} />;
}
