/* /repos/:repoId/conventions — scan the repo for house conventions, review
   the candidates (Accept / Reject / Edit inline) and compile the accepted ones
   into the `repo-conventions` skill. */
"use client";

import React from "react";
import { useParams } from "next/navigation";
import { ConventionsView } from "./_components/ConventionsView";

export default function ConventionsPage() {
  const { repoId } = useParams<{ repoId: string }>();
  return <ConventionsView repoId={repoId} />;
}
