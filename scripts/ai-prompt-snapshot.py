#!/usr/bin/env python3
"""Promote only Admin prompt configuration; never export credentials or resume data."""
import argparse
import json
import os
from pathlib import Path
import shlex
import subprocess
import sys

TABLES = {
    'field_optimize_prompt_config': ('preset_id', 'name', 'description', 'system_prompt', 'description_prompt', 'responsibility_prompt', 'skill_prompt'),
    'resume_analysis_prompt_config': ('scenario_code', 'display_name', 'prompt', 'sort_order'),
}
IDS = {
    'field_optimize_prompt_config': {'standard', 'asu'},
    'resume_analysis_prompt_config': {'WORKING_PROFESSIONAL', 'STUDENT_DAILY_INTERNSHIP', 'STUDENT_SUMMER_INTERNSHIP', 'STUDENT_AUTUMN_RECRUITMENT'},
}


def validate(data, allow_empty=False):
    if not isinstance(data, dict) or set(data) != set(TABLES):
        raise ValueError('提示词快照结构不完整')
    for table, columns in TABLES.items():
        rows = data[table]
        if not isinstance(rows, list):
            raise ValueError('提示词快照缺少记录')
        keys = [row.get(columns[0]) for row in rows if isinstance(row, dict)]
        if len(keys) != len(rows) or len(set(keys)) != len(rows):
            raise ValueError('提示词快照包含重复或无效记录')
        if set(keys) != IDS[table] and not (allow_empty and table == 'field_optimize_prompt_config' and not keys):
            raise ValueError('Admin 提示词未配置完整，请先在本地 Admin 配置')
        for row in rows:
            if set(row) != set(columns):
                raise ValueError('快照包含非提示词字段')
            for column in columns:
                value = row[column]
                if column == 'sort_order':
                    if type(value) is not int:
                        raise ValueError('提示词排序无效')
                elif not isinstance(value, str) or not value.strip() or len(value) > 20000:
                    raise ValueError('提示词内容为空或过长')
            for column in ('description_prompt', 'responsibility_prompt', 'skill_prompt'):
                if column in row and '{{original}}' not in row[column]:
                    raise ValueError('字段提示词缺少原文占位符')
    return {table: sorted(data[table], key=lambda row: row[columns[0]]) for table, columns in TABLES.items()}


def mysql(sql, env):
    args = ['mysql']
    if env.get('MYSQL_CONFIG_FILE'):
        args += ['--defaults-extra-file=' + env['MYSQL_CONFIG_FILE']]
    else:
        args += ['--no-defaults']
    args += ['--batch', '--raw', '--skip-column-names', '--default-character-set=utf8mb4', '--user=' + env.get('MYSQL_USERNAME', 'root')]
    if env.get('MYSQL_SOCKET'):
        args += ['--host=localhost', '--socket=' + env['MYSQL_SOCKET']]
    else:
        args += ['--host=' + ('127.0.0.1' if env.get('MYSQL_HOST', 'localhost') == 'localhost' else env['MYSQL_HOST']), '--port=' + env.get('MYSQL_PORT', '3306')]
    args += ['--database=' + env.get('MYSQL_DATABASE', 'pai_resume')]
    child_env = dict(env)
    child_env['MYSQL_TEST_LOGIN_FILE'] = os.devnull
    if env.get('MYSQL_PASSWORD'):
        child_env['MYSQL_PWD'] = env['MYSQL_PASSWORD']
    result = subprocess.run(args, input=sql, text=True, capture_output=True, env=child_env)
    if result.returncode:
        raise RuntimeError('提示词数据库操作失败，请检查连接及表结构；未输出数据库凭据')
    return result.stdout


def export_snapshot(env, allow_empty=False):
    queries = ['SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;', 'START TRANSACTION WITH CONSISTENT SNAPSHOT;']
    for table, columns in TABLES.items():
        pairs = ','.join("'%s',`%s`" % (col, col) for col in columns)
        queries.append("SELECT JSON_OBJECT('table','%s','row',JSON_OBJECT(%s)) FROM `%s` ORDER BY `%s`;" % (table, pairs, table, columns[0]))
    queries.append('COMMIT;')
    data = {table: [] for table in TABLES}
    for line in mysql('\n'.join(queries), env).splitlines():
        record = json.loads(line)
        data[record['table']].append(record['row'])
    return validate(data, allow_empty)


def literal(value):
    return str(value) if type(value) is int else "CONVERT(X'%s' USING utf8mb4)" % value.encode('utf-8').hex()


def apply_snapshot(data, env, allow_empty=False):
    data = validate(data, allow_empty)
    sql = ['START TRANSACTION;']
    for table, columns in TABLES.items():
        if not data[table]:
            sql.append('DELETE FROM `%s`;' % table)
        for row in data[table]:
            names = ','.join('`%s`' % name for name in columns)
            values = ','.join(literal(row[name]) for name in columns)
            updates = ','.join('`%s`=VALUES(`%s`)' % (name, name) for name in columns[1:])
            sql.append('INSERT INTO `%s` (%s,updated_by) VALUES (%s,0) ON DUPLICATE KEY UPDATE %s,updated_by=0,updated_at=CURRENT_TIMESTAMP;' % (table, names, values, updates))
    sql.append('COMMIT;')
    mysql('\n'.join(sql), env)
    if export_snapshot(env, allow_empty) != data:
        raise RuntimeError('生产提示词回读与发布快照不一致')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['export', 'apply'])
    parser.add_argument('file')
    parser.add_argument('--env-file')
    parser.add_argument('--allow-empty-field', action='store_true')
    options = parser.parse_args()
    env = dict(os.environ)
    if options.env_file:
        for line in Path(options.env_file).read_text().splitlines():
            line = line.strip().removeprefix('export ')
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, value = line.split('=', 1)
            if not key.startswith('MYSQL_'):
                continue
            values = shlex.split(value, comments=True)
            env.setdefault(key, ' '.join(values))
    path = Path(options.file)
    if options.action == 'export':
        data = export_snapshot(env, options.allow_empty_field)
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open('x', encoding='utf-8') as output:
            json.dump(data, output, ensure_ascii=False, sort_keys=True, indent=2)
        path.chmod(0o600)
        print('已导出 Admin 提示词：2 套字段优化、4 套简历分析' if not options.allow_empty_field else '已备份生产 Admin 提示词')
    else:
        apply_snapshot(json.loads(path.read_text()), env, options.allow_empty_field)
        print('Admin 提示词已同步，数据库回读核对一致')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
