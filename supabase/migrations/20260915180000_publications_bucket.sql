-- Private bucket for the publication PDFs and the chart-theme bonus.
-- Created empty and left empty: nothing reads or writes it yet. The files go
-- in once they exist, and get-download-link starts issuing signed urls then.

insert into storage.buckets (id, name, public, file_size_limit)
values ('publications', 'publications', false, 52428800)  -- 50 MB per file
on conflict (id) do nothing;

-- No policies on storage.objects for this bucket, by design. RLS is already on,
-- so anon and authenticated can neither list nor fetch; only the Edge Functions'
-- service_role client can, which is the whole point of a signed-url handoff.
