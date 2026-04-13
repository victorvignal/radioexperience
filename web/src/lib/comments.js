export function buildCommentProfile(userId, profile = {}, fallbackUser = null) {
  if (!userId) {
    return {
      full_name: profile?.full_name || fallbackUser?.user_metadata?.full_name || "Usuário",
      avatar_url: profile?.avatar_url || fallbackUser?.user_metadata?.avatar_url || null,
    };
  }

  const fallbackName =
    profile?.full_name ||
    (fallbackUser?.id === userId ? fallbackUser?.user_metadata?.full_name : null) ||
    (fallbackUser?.id === userId ? fallbackUser?.email?.split("@")[0] : null) ||
    "Usuário";

  return {
    full_name: fallbackName,
    avatar_url:
      profile?.avatar_url ||
      (fallbackUser?.id === userId ? fallbackUser?.user_metadata?.avatar_url : null) ||
      null,
  };
}

export async function fetchProfilesMap(supabase, userIds = []) {
  const uniqueUserIds = [...new Set((userIds || []).filter(Boolean))];
  if (!uniqueUserIds.length) return {};

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", uniqueUserIds);

  if (error) throw error;

  return (data || []).reduce((acc, profile) => {
    acc[profile.id] = profile;
    return acc;
  }, {});
}

export async function fetchCommentsWithProfiles({ supabase, postId, postIds, fallbackUser = null }) {
  const query = supabase
    .from("comments")
    .select("*")
    .order("created_at", { ascending: true });

  if (postId) query.eq("post_id", postId);
  if (postIds?.length) query.in("post_id", postIds);

  const { data, error } = await query;
  if (error) throw error;

  const comments = data || [];
  const profilesMap = await fetchProfilesMap(
    supabase,
    comments.map((comment) => comment.user_id),
  );

  return comments.map((comment) => ({
    ...comment,
    profiles: buildCommentProfile(comment.user_id, profilesMap[comment.user_id], fallbackUser),
  }));
}

export function attachCommentProfile(comment, { profilesMap = {}, fallbackUser = null } = {}) {
  return {
    ...comment,
    profiles: buildCommentProfile(comment.user_id, profilesMap[comment.user_id], fallbackUser),
  };
}
