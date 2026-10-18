import { LoginFormSkeleton, LoginIntro } from "@/components/seeker/LoginForm";

// Shown at once while this page comes from the server (Round 19): the title at once, the form's shape below it.
export default function Loading() {
  return (
    <div className="type-app mx-auto max-w-md pt-2 lg:pt-8">
      <LoginIntro />
      <LoginFormSkeleton />
    </div>
  );
}
