"use client";

import { Select } from "@/components/ui/select";

/** A <select> inside a GET filter form that submits the form on change. */
export function AutoSubmitSelect(props: React.ComponentProps<typeof Select>) {
  return (
    <Select
      {...props}
      onChange={(e) => {
        e.currentTarget.form?.requestSubmit();
      }}
    />
  );
}
