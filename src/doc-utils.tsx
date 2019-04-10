import React, { useState, useContext, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { LiveProvider, LiveEditor, LiveError, LivePreview } from 'react-live';
import { createPortal } from 'react-dom';
import { Typography } from './rmwc';
import * as rmwc from './rmwc';

/* istanbul ignore file */
interface DocumentComponentProps {
  docs: { [key: string]: any };
  displayName: string;
}

class DocumentComponent extends React.Component<DocumentComponentProps> {
  getComponentDef(displayName: string) {
    const componentDef = this.props.docs[displayName];
    const propsDef: any = this.props.docs[displayName + 'Props'];

    const def: {
      name: string;
      description: string;
      props: Array<{
        name: string;
        description: string;
        required: boolean;
        type: string;
      }>;
    } = {
      name: displayName,
      description:
        (propsDef &&
          propsDef.documentation &&
          propsDef.documentation.contentsRaw) ||
        '',
      props: []
    };

    def.props = propsDef
      ? propsDef.properties
          .map((p: any) => {
            const description = p.documentation
              ? p.documentation.contentsRaw
              : '';
            return description.includes('DEPRECATED')
              ? null
              : {
                  name: p.name,
                  description,
                  required: !p.flags.isOptional,
                  type: p.type
                };
          })
          .filter(Boolean)
      : [];

    return def;
  }

  render() {
    const { displayName } = this.props;
    const def = this.getComponentDef(displayName);

    return (
      <div className="document-component">
        <h2>{def.name}</h2>
        <p>{def.description}</p>
        {!!def.props.length && (
          <div>
            <h3>Props</h3>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {def.props.map(prop => (
                  <tr key={prop.name}>
                    <td>
                      <code>{prop.name}</code>
                    </td>
                    <td>
                      <code>{prop.type}</code>
                    </td>

                    <td>{prop.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }
}

export interface DocPropsI {
  src: any;
  components: Array<React.ComponentType<any>>;
}

export class DocProps extends React.Component<DocPropsI> {
  docs: { [key: string]: any } = this.props.src.typescript;

  shouldComponentUpdate() {
    return false;
  }

  render() {
    const { components } = this.props;
    return components.map(c => {
      let name = c.displayName || '';
      name = name.includes('(') ? name.replace(/.+?\((.+?)\)/g, '$1') : name;
      return (
        <DocumentComponent key={name} displayName={name} docs={this.docs} />
      );
    });
  }
}

const DocsContext = React.createContext<{
  scope: Object;
  examples: string[];
}>({
  scope: {},
  examples: []
});

export function Docs({
  children,
  title,
  lead,
  module,
  styles,
  docsLink,
  examples,
  addon
}: {
  children: React.ReactNode;
  title: string;
  lead: string;
  module: string;
  styles: string[];
  docsLink?: string;
  examples: string[];
  addon?: boolean;
}) {
  let index = -1;
  return (
    <DocsContext.Provider value={{ scope: rmwc, examples }}>
      <div>
        <DocsTitle>
          {title}
          {addon && <DocsAddon />}
        </DocsTitle>
        <DocsLead>{lead}</DocsLead>
        <DocsSetup module={module} styles={styles} docsLink={docsLink} />
        {React.Children.map(children, child => {
          if (
            React.isValidElement(child) &&
            // @ts-ignore
            child.type.displayName === 'DocsExample'
          ) {
            index++;
            return React.cloneElement(child, {
              ...child.props,
              index
            } as any);
          }

          return child;
        })}
      </div>
    </DocsContext.Provider>
  );
}

function DocsAddon() {
  return <code>RMWC ADDON</code>;
}

function DocsSetup({
  module,
  styles,
  docsLink
}: {
  module: string;
  styles: string[];
  docsLink?: string;
}) {
  return (
    <ul className="docs-setup">
      <li>
        Module <strong>{module}</strong>
      </li>
      {!!styles.length && (
        <li>
          Import styles:
          <ul>
            {styles.map(s => (
              <li key={s}>
                import <strong>'{s}'</strong>;
              </li>
            ))}
          </ul>
        </li>
      )}
      {!!docsLink && (
        <li>
          MDC Docs: <a href={docsLink}>{docsLink}</a>
        </li>
      )}
    </ul>
  );
}

function DocsTitle({ children }: { children: React.ReactNode }) {
  return <h1>{children}</h1>;
}

export function DocsSubtitle({ children }: { children: React.ReactNode }) {
  return <h2>{children}</h2>;
}

function DocsLead({ children }: { children: React.ReactNode }) {
  return <blockquote>{children}</blockquote>;
}

export function DocsP({ children }: { children: React.ReactNode }) {
  const __html = String(children).replace(/`(.+?)`/g, '<code>$1</code>');
  return <p className="docs-p" dangerouslySetInnerHTML={{ __html }} />;
}

const IFrame = ({
  children,
  ...props
}: {
  children: React.ReactNode;
  head?: React.ReactNode;
}) => {
  const [contentRef, setContentRef] = useState<HTMLIFrameElement | null>(null);
  const [canMount, setCanMount] = React.useState(false);

  const mountNode =
    contentRef &&
    contentRef.contentWindow &&
    contentRef.contentWindow.document.body;

  const headNode =
    contentRef &&
    contentRef.contentWindow &&
    contentRef.contentWindow.document.head;

  useEffect(() => {
    if (headNode) {
      headNode.innerHTML = document.head.innerHTML;
    }

    if (mountNode) {
      mountNode.classList.add('mdc-typography');
      window.requestAnimationFrame(() => {
        setCanMount(true);
      });
    }
  });

  return (
    <iframe {...props} ref={setContentRef} className="docs-iframe">
      {mountNode && canMount && createPortal(<>{children}</>, mountNode)}
    </iframe>
  );
};

export function DocsExample({
  index = 0,
  ...rest
}: {
  children: React.ReactNode;
  index?: number;
  label?: string;
  codeOnly?: boolean;
  iframe?: boolean;
}) {
  const { examples } = useContext(DocsContext);
  const [code] = useState(examples[index]);

  return <DocsExampleBase code={code} {...rest} />;
}

function DocsExampleBase({
  code,
  codeOnly,
  iframe,
  label,
  children
}: {
  code: string;
  codeOnly?: boolean;
  iframe?: boolean;
  label?: string;
  children?: React.ReactNode;
}) {
  return (
    <LiveProvider
      code={code}
      scope={rmwc}
      noInline={!!codeOnly}
      disabled={!!codeOnly}
    >
      <div
        className={`live-example ${codeOnly ? 'live-example-code-only' : ''}`}
      >
        {!codeOnly && (
          <div className="live-preview">
            <div>
              {label && (
                <Typography
                  use="caption"
                  className="live-preview-label"
                  tag="div"
                >
                  {label}
                </Typography>
              )}

              {!!iframe ? (
                <IFrame>
                  <LivePreview>{children}</LivePreview>
                </IFrame>
              ) : (
                <LivePreview>{children}</LivePreview>
              )}
            </div>
          </div>
        )}

        <div className="live-editor">
          <LiveEditor />
          <LiveError className="live-error" />
        </div>
      </div>
    </LiveProvider>
  );
}

export function DocsMarkdown({ fileSrc }: { fileSrc: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    fetch(fileSrc)
      .then(src => src.text())
      .then(src => setSrc(src));
  }, []);

  return src ? (
    <div>
      <ReactMarkdown
        source={src}
        renderers={
          {
            heading: ({
              level,
              children
            }: {
              level: number;
              children: any;
            }) => {
              let Tag: any = 'h1';
              switch (level) {
                case 1:
                  Tag = 'h1';
                  break;
                case 2:
                  Tag = 'h2';
                  break;
                case 3:
                  Tag = 'h3';
                  break;
                case 4:
                  Tag = 'h4';
                  break;
                case 5:
                  Tag = 'h5';
                  break;
                default:
                  break;
              }
              console.log(children);
              return (
                <Tag
                  id={children[0].props.children
                    .toLowerCase()
                    .split(' ')
                    .join('-')}
                >
                  {children}
                </Tag>
              );
            },
            paragraph: ({ children }: { children: any }) => (
              <p className="docs-p">{children}</p>
            ),
            code: ({ value }: { value: string }) => (
              <DocsExampleBase code={value} codeOnly />
            )
          } as any
        }
      />
    </div>
  ) : (
    <></>
  );
}

DocsExample.displayName = 'DocsExample';