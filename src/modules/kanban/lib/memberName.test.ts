import { describe, expect, test } from 'vitest';
import { memberDisplayName, memberRoleLabelKey } from './memberName';

describe('memberDisplayName', () => {
  test('préfère le nom, puis l identifiant public, puis le repli traduit', () => {
    expect(memberDisplayName({ name: ' Camille Dubois ' }, 'Membre')).toBe('Camille Dubois');
    expect(memberDisplayName({ name: '   ', username: 'camille' }, 'Membre')).toBe('camille');
    expect(memberDisplayName(null, 'Membre')).toBe('Membre');
  });
});

describe('memberRoleLabelKey', () => {
  test('sur un tableau relié, `editor` prend le mot de l élément', () => {
    expect(memberRoleLabelKey('editor', 'projects')).toBe('members.linkRoles.editor.projects');
    expect(memberRoleLabelKey('editor', 'organizations')).toBe('members.linkRoles.editor.organizations');
  });

  test('`owner` et `viewer` gardent leur mot partout', () => {
    expect(memberRoleLabelKey('owner', 'organizations')).toBe('members.roles.owner');
    expect(memberRoleLabelKey('viewer', null)).toBe('members.roles.viewer');
    expect(memberRoleLabelKey('editor', null)).toBe('members.roles.editor');
  });
});
