import { ref } from 'vue';
import type { Group, Member, UserGroupMembership } from '@/types';

import { useSupabase } from './useSupabase';

const LOCAL_STORAGE_KEY = 'bean_counter_groups';

export function useGroups() {
    const { supabase } = useSupabase();

    /**
     * Get user's groups from local storage
     */
    function getUserGroups(): UserGroupMembership[] {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    }

    /**
     * Save group membership to local storage
     */
    function saveGroupMembership(groupId: string, memberId: string) {
        const groups = getUserGroups();
        const existing = groups.find((g) => g.group_id === groupId);

        if (existing) {
            existing.member_id = memberId;
        } else {
            groups.push({ group_id: groupId, member_id: memberId });
        }

        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(groups));
    }

    /**
     * Get which member represents the user in a group
     */
    function getUserMemberIdForGroup(groupId: string): string | null {
        const groups = getUserGroups();
        const membership = groups.find((g) => g.group_id === groupId);
        return membership?.member_id || null;
    }

    /**
     * Create a new group with initial members
     */
    async function createGroup(
        name: string,
        defaultCurrency: string,
        memberNames: string[],
    ): Promise<{ group: Group; members: Member[] } | null> {
        try {
            // Create group
            const { data: group, error: groupError } = await supabase
                .from('groups')
                .insert({ name, default_currency: defaultCurrency })
                .select()
                .single();

            if (groupError || !group) {
                console.error('Error creating group:', groupError);
                return null;
            }

            // Create members
            const membersToInsert = memberNames.map((name) => ({
                group_id: group.id,
                name,
            }));

            const { data: members, error: membersError } = await supabase
                .from('members')
                .insert(membersToInsert)
                .select();

            if (membersError || !members) {
                console.error('Error creating members:', membersError);
                return null;
            }

            return { group, members };
        } catch (error) {
            console.error('Error in createGroup:', error);
            return null;
        }
    }

    /**
     * Get group by ID
     */
    async function getGroup(groupId: string): Promise<Group | null> {
        try {
            const { data, error } = await supabase
                .from('groups')
                .select('*')
                .eq('id', groupId)
                .single();

            if (error) {
                console.error('Error fetching group:', error);
                return null;
            }

            return data;
        } catch (error) {
            console.error('Error in getGroup:', error);
            return null;
        }
    }

    /**
     * Get all members of a group
     */
    async function getGroupMembers(groupId: string): Promise<Member[]> {
        try {
            const { data, error } = await supabase
                .from('members')
                .select('*')
                .eq('group_id', groupId)
                .order('name');

            if (error) {
                console.error('Error fetching members:', error);
                return [];
            }

            return data || [];
        } catch (error) {
            console.error('Error in getGroupMembers:', error);
            return [];
        }
    }

    /**
     * Add a new member to a group
     */
    async function addMember(
        groupId: string,
        name: string,
    ): Promise<Member | null> {
        try {
            const { data, error } = await supabase
                .from('members')
                .insert({ group_id: groupId, name })
                .select()
                .single();

            if (error) {
                console.error('Error adding member:', error);
                return null;
            }

            return data;
        } catch (error) {
            console.error('Error in addMember:', error);
            return null;
        }
    }

    /**
     * Update group settings
     */
    async function updateGroup(
        groupId: string,
        updates: { name?: string; default_currency?: string },
    ): Promise<Group | null> {
        try {
            const { data, error } = await supabase
                .from('groups')
                .update(updates)
                .eq('id', groupId)
                .select()
                .single();

            if (error) {
                console.error('Error updating group:', error);
                return null;
            }

            return data;
        } catch (error) {
            console.error('Error in updateGroup:', error);
            return null;
        }
    }

    return {
        getUserGroups,
        saveGroupMembership,
        getUserMemberIdForGroup,
        createGroup,
        getGroup,
        getGroupMembers,
        addMember,
        updateGroup,
    };
}
