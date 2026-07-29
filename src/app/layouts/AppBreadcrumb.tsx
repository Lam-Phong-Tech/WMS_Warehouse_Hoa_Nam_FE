import { Breadcrumb } from "antd";
import { Link, useLocation } from "react-router-dom";
import { HomeOutlined } from "@ant-design/icons";
import { getBreadcrumb } from "@/app/layouts/menu";
import { layoutStyles } from "@/app/layouts/layout.styles";

/** Breadcrumb tự sinh theo route hiện tại (dựa trên cấu hình MENU). */
export function AppBreadcrumb() {
  const location = useLocation();
  const crumbs = getBreadcrumb(location.pathname, location.search);

  if (crumbs.length === 0) return null;

  return (
    <Breadcrumb
      style={layoutStyles.breadcrumb}
      items={[
        {
          title: (
            <Link to="/">
              <HomeOutlined style={{ fontSize: 14 }} />
            </Link>
          ),
        },
        ...crumbs.map((c) => ({
          title: c.path ? <Link to={c.path}>{c.label}</Link> : c.label,
        })),
      ]}
    />
  );
}
