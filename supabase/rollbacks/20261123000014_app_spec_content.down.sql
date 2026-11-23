-- Rollback of 20261123000014: nothing to undo in the schema. The migration only changed DRAFT content
-- (plans, pricing rules, FAQ); earlier values are in the audit log and in published releases (use Roll back
-- in the admin to return the live site to an earlier release).
select 1;
