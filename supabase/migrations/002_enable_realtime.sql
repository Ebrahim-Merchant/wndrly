-- Enable Supabase Realtime on key tables
-- Run this in the Supabase SQL Editor: https://supabase.com/dashboard/project/xfvayfokefudhxtlcprj/sql

ALTER PUBLICATION supabase_realtime ADD TABLE trips;
ALTER PUBLICATION supabase_realtime ADD TABLE places;
ALTER PUBLICATION supabase_realtime ADD TABLE days;
ALTER PUBLICATION supabase_realtime ADD TABLE collab_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE todo_items;
ALTER PUBLICATION supabase_realtime ADD TABLE packing_items;
ALTER PUBLICATION supabase_realtime ADD TABLE trip_members;
