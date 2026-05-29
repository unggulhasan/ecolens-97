# Next.js template

This is a Next.js template with shadcn/ui.

## Environment variables
Copy `./.env.local.example` to `./.env.local` and fill values if you are running the frontend without Terraform.
If you run `terraform apply` from `../infra`, Terraform will generate `./.env.local` for you.


## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button";
```
