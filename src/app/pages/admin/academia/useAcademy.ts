import { useCallback, useEffect, useState } from "react";
import { loadAcademy, message } from "./service";
import { getCurrentUserRoles } from "@/lib/rbac";
import { supabase } from "@/lib/supabase";
import type { AcademyData } from "./types";
export function useAcademy() {
  const [data, setData] = useState<AcademyData | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [userId, setUserId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [next, roleRes, session] = await Promise.all([
        loadAcademy(),
        getCurrentUserRoles(),
        supabase.auth.getSession(),
      ]);
      if (roleRes.error) throw new Error(roleRes.error);
      setData(next);
      setRoles(roleRes.roles);
      setUserId(session.data.session?.user.id || "");
    } catch (e) {
      setData(null);
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  const admin = roles.some((r) => ["admin_alfa", "admin"].includes(r));
  const editCourses =
    data?.courseInstructors
      .filter(
        (ci) =>
          ci.can_edit &&
          data.instructors.some(
            (i) =>
              i.id === ci.instructor_id &&
              data.members.some(
                (m) => m.id === i.member_id && m.user_id === userId,
              ),
          ),
      )
      .map((ci) => ci.course_id) || [];
  const canEdit = (course: string) => admin || editCourses.includes(course);
  return {
    data,
    roles,
    userId,
    error,
    loading,
    reload,
    admin,
    canEdit,
    manager: admin || editCourses.length > 0,
  };
}
