import React from "react";

import { HomePage, ResetPasswordPage, SignInPage, SignUpPage } from "./pages";
import { RESET_PASSWORD_ROUTE, SIGN_IN_ROUTE, SIGN_UP_ROUTE } from "./store/constants/route-constants";

interface Page {
  id: number;
  path: string;
  title: string;
  element: React.ReactElement;
}

const routes: Page[] = [
  {
    id: 1,
    path: "/",
    title: "HomePage",
    element: <HomePage />,
  },
  {
    id: 2,
    path: SIGN_UP_ROUTE,
    title: "SignUpPage",
    element: <SignUpPage />,
  },
  {
    id: 3,
    path: SIGN_IN_ROUTE,
    title: "SignInPage",
    element: <SignInPage />,
  },
  {
    id: 4,
    path: RESET_PASSWORD_ROUTE,
    title: "ResetPasswordPage",
    element: <ResetPasswordPage />,
  },
];

export default routes;
