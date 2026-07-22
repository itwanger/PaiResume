package com.itwanger.pairesume.config;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FlywayMigrationConfigTest {

    private Flyway flyway;
    private ResultSet tables;

    @BeforeEach
    void setUp() throws Exception {
        flyway = mock(Flyway.class);
        var configuration = mock(org.flywaydb.core.api.configuration.Configuration.class);
        DataSource dataSource = mock(DataSource.class);
        Connection connection = mock(Connection.class);
        DatabaseMetaData metadata = mock(DatabaseMetaData.class);
        tables = mock(ResultSet.class);

        when(flyway.getConfiguration()).thenReturn(configuration);
        when(configuration.getDataSource()).thenReturn(dataSource);
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.getCatalog()).thenReturn("pai_resume");
        when(connection.getMetaData()).thenReturn(metadata);
        when(metadata.getTables(any(), isNull(), any(), any())).thenReturn(tables);
    }

    @Test
    void baselineBeforeMigratingAnEmptyDatabase() throws Exception {
        when(tables.next()).thenReturn(false);

        new FlywayMigrationConfig().flywayMigrationStrategy().migrate(flyway);

        verify(flyway).baseline();
        verify(flyway).migrate();
    }

    @Test
    void migrateExistingDatabaseWithoutCreatingAnotherBaseline() throws Exception {
        when(tables.next()).thenReturn(true);

        new FlywayMigrationConfig().flywayMigrationStrategy().migrate(flyway);

        verify(flyway, never()).baseline();
        verify(flyway).migrate();
    }
}
