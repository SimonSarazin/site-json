interface ProfileMembersProps {
  section: {
    type: "profile-members";
    title?: { fr?: string; en?: string };
    limit?: number;
    showRole?: boolean;
  };
}

export default function ProfileMembers({ section: _section }: ProfileMembersProps) {
  // À implémenter selon vos besoins
  // Si besoin d'entity: const { entity } = useProfileEntity();
  return null;
}
