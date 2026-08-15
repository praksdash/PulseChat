-- PulseChat Phase 12 hotfix verification
select
  position(
    'on conflict on constraint messages_sender_client_unique'
    in pg_get_functiondef(
      'public.create_image_message(uuid,uuid,text,text,bigint,integer,integer,text)'::regprocedure
    )
  ) > 0 as image_message_conflict_target_fixed;
