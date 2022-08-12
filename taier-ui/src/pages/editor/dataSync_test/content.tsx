import { useEffect, useState } from 'react';
import { Button, Form, Space } from 'antd';
import {
	DataSourceSelect,
	ExtralConfigTextarea,
	IncreColumnSelect,
	SplitSelect,
	TableMultiSelect,
	TableSingleSelect,
	WhereTextarea,
} from '@/components/scaffolds/task';
import notification from '@/components/notification';
import { DATA_SYNC_MODE, formItemLayout } from '@/constant';
import molecule from '@dtinsight/molecule';
import { get } from 'lodash';
import { IStepsActionKind } from '.';

const templateRegistry: Record<string, (...args: any[]) => JSX.Element> = {
	sourceId: ({ label }: { label?: string }) => <DataSourceSelect label={label} />,
	tableMulti: () => <TableMultiSelect />,
	table: () => <TableSingleSelect />,
	increColumn: () => <IncreColumnSelect />,
	extralConfig: () => <ExtralConfigTextarea />,
	where: () => <WhereTextarea />,
	splitPK: () => <SplitSelect />,
};

interface IDataSyncContentProps {
	/**
	 * 当前 Steps
	 */
	current: number;
	onStepChange: React.Dispatch<{
		type: IStepsActionKind;
		payload?: number | undefined;
	}>;
}

interface ISchemaProps {
	name: string;
	label?: string;
	/**
	 * 表单内部的依赖字段
	 */
	dependencies: { field: string; value?: string; isNot?: boolean }[];
	/**
	 * 表单外部的依赖字段，如当前 tab 上的相关属性
	 */
	globalDependencies: ISchemaProps['dependencies'];
	/**
	 * 当前字段需要监听的字段，当监听字段值改变，当前字段置空
	 */
	watch: string[];
}

/**
 * 对比两个值是否相等，
 */
function compareValueWithNot(
	value1: string | undefined | null,
	value2: string | undefined | null,
	isNot: boolean = false,
) {
	if (value2) {
		const tmpResult = `${value2}`.includes(`${value1}`);
		return isNot ? !tmpResult : !!tmpResult;
	}

	return isNot ? !value1 : !!value1;
}

export default function Content({ current, onStepChange }: IDataSyncContentProps) {
	const [form] = Form.useForm();
	const [templates, setTemplates] = useState<ISchemaProps[][]>([]);

	useEffect(() => {
		// Get Template data
		fetch('./layout/dataSync.json')
			.then<
				{
					fields: (
						| string
						| { name: string; label?: string; dependsOn?: string[]; watch?: string[] }
					)[];
				}[]
			>((res) => res.json())
			.then((res) => {
				const temp = res.map((i) => {
					return i.fields.map((field) => {
						if (typeof field === 'string') {
							return {
								name: field,
								dependencies: [],
								globalDependencies: [],
								watch: [],
							} as ISchemaProps;
						}

						const bracketRegex = /\{\{(.*?)\}}/;

						// The dependencies which don't need to be executed
						const rawDepends =
							field.dependsOn?.filter((d) => !bracketRegex.test(d)) || [];
						// The dependencies which need to be executed, like {{xxx.yyy}}
						const expressionDepends =
							field.dependsOn?.filter((d) => bracketRegex.test(d)) || [];

						// The form expressions like {{form.xxx.yyy}}
						const formExpressDepends = [];
						const globalExpressDepends = [];

						for (let index = 0; index < expressionDepends.length; index += 1) {
							const expression = expressionDepends[index];
							const matchResults = expression.match(bracketRegex) || [];
							if (matchResults[1]) {
								const matchContent: string = matchResults[1];
								let [leftHandExpress = '', rightHandExpress = ''] =
									matchContent.split('=');
								leftHandExpress = leftHandExpress.trim();
								rightHandExpress = rightHandExpress.trim();

								// 是否需要取反;
								let isNot = false;

								if (
									leftHandExpress.startsWith('!') ||
									leftHandExpress.endsWith('!')
								) {
									isNot = true;

									leftHandExpress = leftHandExpress.startsWith('!')
										? leftHandExpress.substring(1)
										: leftHandExpress.substring(0, leftHandExpress.length - 1);
								}

								const exp: ISchemaProps['dependencies'][number] = {
									field: leftHandExpress,
									isNot,
								};

								if (rightHandExpress) {
									exp.value = rightHandExpress;
								}

								if (leftHandExpress.startsWith('form')) {
									formExpressDepends.push(exp);
								} else {
									globalExpressDepends.push(exp);
								}
							}
						}

						// To get the {{form.xxx.yyy}} expression in dependencies
						// And combine it with rawDepends to pass through to form's dependencies
						const dependencies = rawDepends
							.map((d) => ({
								field: `form.${d}`,
							}))
							.concat(formExpressDepends);

						return {
							name: field.name,
							label: field.label,
							dependencies,
							globalDependencies: globalExpressDepends,
							watch: field.watch || [],
						} as ISchemaProps;
					});
				});
				setTemplates(temp);
			});
	}, []);

	const globalVariables = {
		increment:
			molecule.editor.getState().current?.tab?.data?.sourceMap?.syncModel ===
			DATA_SYNC_MODE.INCREMENT,
	};

	const handleFormValueChanged = (changed: Record<string, any>) => {
		Object.keys(changed).forEach((key) => {
			const template = templates[current].filter((temp) => temp.watch.includes(key));
			form.resetFields(template.map((t) => t.name));
		});
	};

	const handleSubmitNext = (next: boolean) => {
		if (next) {
			form.validateFields().then(() => {
				onStepChange({ type: IStepsActionKind.INCREMENT });
			});
		} else {
			onStepChange({ type: IStepsActionKind.DECREMENT });
		}
	};

	return (
		<>
			<Form
				form={form}
				preserve={false}
				{...formItemLayout}
				onValuesChange={handleFormValueChanged}
			>
				{templates[current]?.map((template) => {
					const name = typeof template === 'string' ? template : template.name;
					const Component = templateRegistry[name];
					if (Component) {
						const dependencies = template.dependencies.map((d) => d.field);

						const globalExpression = template.globalDependencies.reduce(
							(exp, depend) => {
								if (!exp) return false;
								const value = get({ global: globalVariables }, depend.field);
								return compareValueWithNot(value, depend.value, depend.isNot);
							},
							true,
						);

						if (dependencies.length) {
							return (
								<Form.Item key={name} noStyle dependencies={dependencies}>
									{({ getFieldsValue }) =>
										// ONLY the all dependencies get truly results could the component rendered
										template.dependencies
											.map((depend) => {
												const value = get(
													{ form: getFieldsValue() },
													depend.field,
												);
												return compareValueWithNot(
													value,
													depend.value,
													depend.isNot,
												);
											})
											.every(Boolean) &&
										globalExpression && (
											<Component key={template.name} label={template.label} />
										)
									}
								</Form.Item>
							);
						}

						return (
							globalExpression && (
								<Component key={template.name} label={template.label} />
							)
						);
					}

					notification.error({
						key: 'UNDEFINED_TEMPLATE_KEY',
						message: `未注册过的 template: ${name}`,
					});
					return null;
				})}
				<Form.Item wrapperCol={{ span: 24 }}>
					<div className="text-center">
						<Space size={15}>
							{Boolean(current) && (
								<Button type="primary" onClick={() => handleSubmitNext(false)}>
									上一步
								</Button>
							)}
							<Button type="primary" onClick={() => handleSubmitNext(true)}>
								下一步
							</Button>
						</Space>
					</div>
				</Form.Item>
			</Form>
		</>
	);
}
