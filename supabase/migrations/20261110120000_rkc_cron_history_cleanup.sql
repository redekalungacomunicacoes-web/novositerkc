select cron.schedule(
  'rkc-cleanup-cron-history',
  '0 3 * * *',
  $job$
    delete from cron.job_run_details
     where end_time < now() - interval '14 days';
  $job$
);
