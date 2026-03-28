/** Graph — shared types for person/role/activity relationships. */

export type Activity = {
  id: string;
  name: string;
};

export type Role = {
  id: string;
  name: string;
  activities: string[]; // activity IDs
};

export type Person = {
  id: string;
  name: string;
  primaryRole: string; // role ID
  roles: string[]; // role IDs
};

export type GraphDoc = {
  activities: Activity[];
  roles: Role[];
  persons: Person[];
};
