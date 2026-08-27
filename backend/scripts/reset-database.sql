/*
  SmartWash destructive database reset for SSMS.

  WHAT IT DOES
  - Keeps the database itself.
  - Drops every user table (including __EFMigrationsHistory) in the current DB.
  - Does NOT run migrations afterwards.

  BEFORE RUNNING
  1) Stop/recycle the SmartWash API so it has no active connection.
  2) Change @ExpectedDatabase to your EXACT target database name.
  3) Execute this script while connected to that database in SSMS.
  4) Afterwards create/apply the initial EF migration from the backend folder.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @ExpectedDatabase sysname = N'REPLACE_WITH_SMARTWASH_DATABASE_NAME';

IF DB_NAME() <> @ExpectedDatabase
BEGIN
    THROW 51000, 'Safety stop: SSMS is not connected to @ExpectedDatabase. Set the exact database name and run again.', 1;
END;

BEGIN TRY
    BEGIN TRANSACTION;

    DECLARE @sql nvarchar(max) = N'';

    -- Tables cannot be dropped while foreign keys point at them.
    SELECT @sql += N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(parent_object_id)) + N'.' + QUOTENAME(OBJECT_NAME(parent_object_id))
                 + N' DROP CONSTRAINT ' + QUOTENAME(name) + N';' + CHAR(13) + CHAR(10)
    FROM sys.foreign_keys
    WHERE is_ms_shipped = 0;

    IF @sql <> N'' EXEC sys.sp_executesql @sql;

    SET @sql = N'';
    SELECT @sql += N'DROP TABLE ' + QUOTENAME(SCHEMA_NAME(schema_id)) + N'.' + QUOTENAME(name) + N';' + CHAR(13) + CHAR(10)
    FROM sys.tables
    WHERE is_ms_shipped = 0;

    IF @sql <> N'' EXEC sys.sp_executesql @sql;

    COMMIT TRANSACTION;
    PRINT N'SmartWash tables were dropped. The database itself remains intact.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
