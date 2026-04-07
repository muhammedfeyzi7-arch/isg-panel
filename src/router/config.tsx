import type { RouteObject } from "react-router-dom";
import NotFound from "../pages/NotFound";
import Home from "../pages/home/page";
import Saha from "../pages/saha/page";

const routes: RouteObject[] = [
  {
    path: "/",
    element: <Home />,
  },
  {
    path: "/saha",
    element: <Saha />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
];

export default routes;
